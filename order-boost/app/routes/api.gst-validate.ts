import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const GST_NUMBER_PATTERN = /^[0-9A-Z]{15}$/;

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { cors } = await authenticate.public.checkout(request);

  return cors(new Response(null, { status: 204 }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { cors } = await authenticate.public.checkout(request);
  const gstApiKey = process.env.GST_API_KEY?.trim();

  if (!gstApiKey) {
    return cors(
      json(
        { valid: false, error: "GST_API_KEY is not configured." },
        { status: 500 },
      ),
    );
  }

  const body = await request.json().catch(() => null);
  const gstNumber =
    typeof body?.gstNumber === "string"
      ? body.gstNumber.trim().toUpperCase()
      : "";

//   if (!GST_NUMBER_PATTERN.test(gstNumber)) {
//     return cors(json({ valid: false }));
//   }

  const response = await fetch(
    `https://sheet.gstincheck.co.in/check/${gstApiKey}/${encodeURIComponent(
      gstNumber,
    )}`,
  );

  if (!response.ok) {
    return cors(
      json(
        { valid: false, error: "GST validation service is unavailable." },
        { status: 502 },
      ),
    );
  }

  const data = await response.json();

  console.log("DATA", data);
  return cors(json({ valid: data.flag === true, lgnm: data.data.lgnm }));
};
