import {
    useLoaderData,
  type ActionFunctionArgs,
  type HeadersFunction,
  type LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import WelcomeCard from "components/marketing/welcome/WelcomeCard";
import CollectionShare from "components/marketing/collections/CollectionShare";

const LATEST_PRODUCTS_INTENT = "send-latest-products-email";
const WELCOME_EMAIL_INTENT = "send-welcome-email";
const RECENT_PRODUCT_DAYS = 5;

type ShopifyCustomer = {
  id: string;
  firstName: string | null;
  verifiedEmail: boolean;
  defaultEmailAddress?: {
    emailAddress?: string | null;
    marketingState?: string | null;
  } | null;
};

type EligibleCustomer = {
  id: string;
  firstName: string | null;
  email: string;
};

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  onlineStoreUrl: string | null;
  createdAt: string;
  featuredImage?: {
    url: string;
    altText: string | null;
  } | null;
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
};

type EligibleProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  imageAlt: string;
  price: string;
  productUrl: string;
};

type ShopInfo = {
  name: string;
  primaryDomain?: {
    url?: string | null;
  } | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`#grapql
    query GetProductTags {
        productTags(first: 100) {
            nodes
            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }`);
  const responseJson = await response.json();
  console.log("responseJson", responseJson.data)
  if (responseJson.data) {
    return {nodes: responseJson.data.productTags?.nodes};
  }

  return null;
};

function getEnvValue(name: string) {
  const value = process.env[name]?.trim();

  return value || null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(amount: string, currencyCode: string) {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return `${amount} ${currencyCode}`;
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
  }).format(numericAmount);
}

function getProductUrl(product: ShopifyProduct, shop: ShopInfo) {
  if (product.onlineStoreUrl) {
    return product.onlineStoreUrl;
  }

  const shopUrl = shop.primaryDomain?.url?.replace(/\/$/, "");

  return shopUrl
    ? `${shopUrl}/products/${product.handle}`
    : `/products/${product.handle}`;
}

function toEligibleProduct(product: ShopifyProduct, shop: ShopInfo) {
  return {
    id: product.id,
    title: product.title,
    imageUrl: product.featuredImage?.url ?? null,
    imageAlt: product.featuredImage?.altText ?? product.title,
    price: formatMoney(
      product.priceRangeV2.minVariantPrice.amount,
      product.priceRangeV2.minVariantPrice.currencyCode,
    ),
    productUrl: getProductUrl(product, shop),
  };
}

function toEligibleCustomers(customers: ShopifyCustomer[]) {
  const seenEmails = new Set<string>();
  const eligibleCustomers: EligibleCustomer[] = [];

  for (const customer of customers) {
    const email = customer.defaultEmailAddress?.emailAddress?.trim();
    const normalizedEmail = email?.toLowerCase();

    if (
      !email ||
      !normalizedEmail ||
      seenEmails.has(normalizedEmail) ||
      customer.defaultEmailAddress?.marketingState !== "SUBSCRIBED" ||
      !customer.verifiedEmail
    ) {
      continue;
    }

    seenEmails.add(normalizedEmail);
    eligibleCustomers.push({
      id: customer.id,
      firstName: customer.firstName,
      email,
    });
  }

  return eligibleCustomers;
}

async function readShopifyResponse<T>(response: Response) {
  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(
      json.errors[0]?.message ?? "Shopify GraphQL request failed.",
    );
  }

  return json.data as T;
}

async function fetchRecentProducts(admin: any, shop: ShopInfo, tags:string[]) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_PRODUCT_DAYS);

  let tagQuery;
  if (tags.length) {
    tagQuery = tags.map((tag: string) => `tag:${tag}`).join(" OR ")
  }
  const query = `created_at:>=${cutoff.toISOString()} OR (${tagQuery})`;
  const productsById = new Map<string, EligibleProduct>();
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: Response = await admin.graphql(
      `#graphql
        query GetRecentProducts($cursor: String, $query: String!) {
          products(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
            nodes {
              id
              title
              handle
              onlineStoreUrl
              createdAt
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`,
      { variables: { cursor, query } },
    );

    const data: {
      products: {
        nodes: ShopifyProduct[];
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    } = await readShopifyResponse(response);

    for (const product of data.products.nodes) {
      if (!productsById.has(product.id)) {
        productsById.set(product.id, toEligibleProduct(product, shop));
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  return Array.from(productsById.values());
}

async function fetchEligibleCustomers(admin: any) {
  const customers: ShopifyCustomer[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: Response = await admin.graphql(
      `#graphql
        query GetCustomers($cursor: String) {
          customers(first: 100, after: $cursor) {
            nodes {
              id
              firstName
              verifiedEmail
              defaultEmailAddress {
                emailAddress
                marketingState
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`,
      { variables: { cursor } },
    );

    const data: {
      customers: {
        nodes: ShopifyCustomer[];
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    } = await readShopifyResponse(response);

    customers.push(...data.customers.nodes);
    hasNextPage = data.customers.pageInfo.hasNextPage;
    cursor = data.customers.pageInfo.endCursor;
  }

  return toEligibleCustomers(customers);
}

async function fetchShopInfo(admin: any) {
  const response = await admin.graphql(
    `#graphql
      query GetShopInfo {
        shop {
          name
          primaryDomain {
            url
          }
        }
      }`,
  );

  const data = await readShopifyResponse<{ shop: ShopInfo }>(response);

  return data.shop;
}

function buildLatestProductsEmailHtml(
  customer: EligibleCustomer,
  products: EligibleProduct[],
  shopName: string,
) {
  const greetingName = customer.firstName?.trim() || "there";
  const productItems = products
    .map((product) => {
      const image = product.imageUrl
        ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.imageAlt)}" style="width: 100%; max-width: 520px; border-radius: 8px; display: block; margin-bottom: 16px;" />`
        : "";

      return `
        <div style="padding: 20px 0; border-top: 1px solid #e5e5e5;">
          ${image}
          <h2 style="font-size: 20px; line-height: 1.3; margin: 0 0 8px;">${escapeHtml(product.title)}</h2>
          <p style="font-size: 16px; margin: 0 0 16px;">${escapeHtml(product.price)}</p>
          <a href="${escapeHtml(product.productUrl)}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-decoration: none;">View product</a>
        </div>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background: #f6f6f7; font-family: Arial, sans-serif; color: #202223;">
        <div style="max-width: 640px; margin: 0 auto; padding: 32px 20px;">
          <div style="background: #ffffff; border-radius: 8px; padding: 28px;">
            <p style="font-size: 16px; margin: 0 0 8px;">Hi ${escapeHtml(greetingName)},</p>
            <h1 style="font-size: 28px; line-height: 1.2; margin: 0 0 12px;">New arrivals just landed</h1>
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Take a look at the latest products from ${escapeHtml(shopName)}.</p>
            ${productItems}
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildWelcomeEmailHtml(customer: EligibleCustomer, shop: ShopInfo) {
  const greetingName = customer.firstName?.trim() || "there";
  const shopName = shop.name;
  const shopUrl = shop.primaryDomain?.url?.replace(/\/$/, "") ?? "";
  const escapedShopName = escapeHtml(shopName);
  const shopButton = shopUrl
    ? `<a href="${escapeHtml(shopUrl)}" style="display: inline-block; background: #111827; color: #ffffff; padding: 14px 20px; border-radius: 6px; text-decoration: none; font-weight: 700;">Start shopping</a>`
    : "";

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Welcome to ${escapedShopName}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f6f6f7; font-family: Arial, sans-serif; color: #202223;">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
          Thanks for joining ${escapedShopName}. We are glad you are here.
        </div>
        <div style="max-width: 640px; margin: 0 auto; padding: 32px 20px;">
          <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
            <div style="background: #111827; padding: 28px; color: #ffffff;">
              <p style="font-size: 14px; line-height: 1.4; margin: 0 0 8px; letter-spacing: 0; text-transform: uppercase;">Welcome to ${escapedShopName}</p>
              <h1 style="font-size: 30px; line-height: 1.2; margin: 0;">We are happy to have you with us.</h1>
            </div>
            <div style="padding: 28px;">
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Hi ${escapeHtml(greetingName)},</p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Thanks for signing up for updates from ${escapedShopName}. You will be the first to hear about new arrivals, useful product picks, and special store updates.
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                We keep our emails simple and helpful, so you can discover what is new without the noise.
              </p>
              ${shopButton}
              <div style="border-top: 1px solid #e5e7eb; margin-top: 28px; padding-top: 20px;">
                <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #6b7280;">
                  You are receiving this email because you subscribed to marketing emails from ${escapedShopName}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendBrevoEmail({
  apiKey,
  senderEmail,
  senderName,
  customer,
  subject,
  body,
}: {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  customer: EligibleCustomer;
  subject: string;
  body: string;
}) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [
        {
          email: customer.email,
          name: customer.firstName ?? undefined,
        },
      ],
      subject,
      htmlContent: body,
    }),
  });

  if (!response.ok) {
    let message = `Brevo request failed with status ${response.status}.`;
    const errorText = await response.text();

    try {
      const errorJson = JSON.parse(errorText);
      message = errorJson.message ?? message;
    } catch {
      message = errorText || message;
    }

    throw new Error(message);
  }
}

async function sendLatestProductsEmailCampaign(admin: any, tags: string[]) {
  const brevoApiKey = getEnvValue("BREVO_API_KEY");
  const senderEmail = getEnvValue("BREVO_SENDER_EMAIL");

  if (!brevoApiKey) {
    return {
      success: false,
      error: "BREVO_API_KEY is required to send the latest products email.",
    };
  }

  if (!senderEmail) {
    return {
      success: false,
      error:
        "BREVO_SENDER_EMAIL is required to send the latest products email.",
    };
  }

  try {
    const shop = await fetchShopInfo(admin);
    const senderName = getEnvValue("BREVO_SENDER_NAME") ?? shop.name;
    const products = await fetchRecentProducts(admin, shop, tags);

    if (products.length === 0) {
      return {
        success: true,
        message:
          "No products created in the last 5 days with the latest or featured tag.",
        eligibleProducts: 0,
        eligibleCustomers: 0,
        sentEmails: 0,
        failedEmails: 0,
      };
    }

    const customers = await fetchEligibleCustomers(admin);

    if (customers.length === 0) {
      return {
        success: true,
        message: "No subscribed and verified customers were found.",
        eligibleProducts: products.length,
        eligibleCustomers: 0,
        sentEmails: 0,
        failedEmails: 0,
      };
    }

    let sentEmails = 0;
    let failedEmails = 0;
    const errors: string[] = [];

    for (const customer of customers) {
      try {
        await sendBrevoEmail({
          apiKey: brevoApiKey,
          senderEmail,
          senderName,
          customer,
          subject: "New arrivals just landed",
          body: buildLatestProductsEmailHtml(customer, products, senderName),
        });
        sentEmails += 1;
      } catch (error) {
        failedEmails += 1;
        errors.push(
          `${customer.email}: ${
            error instanceof Error ? error.message : "Unknown Brevo error"
          }`,
        );
      }
    }

    return {
      success: failedEmails === 0,
      message:
        failedEmails === 0
          ? "Latest products email campaign sent successfully."
          : "Latest products email campaign completed with some failures.",
      eligibleProducts: products.length,
      eligibleCustomers: customers.length,
      sentEmails,
      failedEmails,
      error: failedEmails > 0 ? errors.slice(0, 3).join(" ") : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send latest products email campaign.",
    };
  }
}

async function sendWelcomeEmailToCustomers(admin: any) {
  const brevoApiKey = getEnvValue("BREVO_API_KEY");
  const senderEmail = getEnvValue("BREVO_SENDER_EMAIL");

  if (!brevoApiKey) {
    return {
      success: false,
      error: "BREVO_API_KEY is required to send the welcome email.",
    };
  }

  if (!senderEmail) {
    return {
      success: false,
      error: "BREVO_SENDER_EMAIL is required to send the welcome email.",
    };
  }

  try {
    const shop = await fetchShopInfo(admin);
    const senderName = getEnvValue("BREVO_SENDER_NAME") ?? shop.name;

    const customers = await fetchEligibleCustomers(admin);

    if (customers.length === 0) {
      return {
        success: true,
        message: "No subscribed and verified customers were found.",
        eligibleCustomers: 0,
        sentEmails: 0,
        failedEmails: 0,
      };
    }

    let sentEmails = 0;
    let failedEmails = 0;
    const errors: string[] = [];

    for (const customer of customers) {
      try {
        await sendBrevoEmail({
          apiKey: brevoApiKey,
          senderEmail,
          senderName,
          customer,
          subject: `Welcome to ${shop.name}`,
          body: buildWelcomeEmailHtml(customer, shop),
        });
        sentEmails += 1;
      } catch (error) {
        failedEmails += 1;
        errors.push(
          `${customer.email}: ${
            error instanceof Error ? error.message : "Unknown Brevo error"
          }`,
        );
      }
    }

    return {
      success: failedEmails === 0,
      message:
        failedEmails === 0
          ? "Welcome email campaign sent successfully."
          : "Welcome email campaign completed with some failures.",
      eligibleCustomers: customers.length,
      totalSent: sentEmails,
      sentEmails,
      failedEmails,
      error: failedEmails > 0 ? errors.slice(0, 3).join(" ") : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send welcome email campaign.",
    };
  }
}
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === LATEST_PRODUCTS_INTENT) {
    const tags = JSON.parse(formData.get('tags') as string || [] as any);
    return sendLatestProductsEmailCampaign(admin, tags);
  } else if (intent === WELCOME_EMAIL_INTENT) {
    return sendWelcomeEmailToCustomers(admin);
  }

  return {
    success: false,
    error: "Unsupported marketing action.",
  };
};

export default function Index() {
    const productTags = useLoaderData();
    console.log("productTags", productTags);
  return (
    <s-page heading="Marketing">
      <WelcomeCard />
      <CollectionShare productTags={productTags.nodes}/>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
