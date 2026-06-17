import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../../../app/shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

// export { action } from "./send-marketing";
const WELCOME_EMAIL_INTENT = "send-welcome-email";
export default function Index() {
    const fetcher = useFetcher();
    const isSending = fetcher.state === "submitting";
    const result = fetcher.data;

    const handleSend = () => {
        console.log("SUBMITTED")
            const formData = new FormData();
        formData.set("intent", WELCOME_EMAIL_INTENT);
        fetcher.submit(formData, { method: "POST" });
    };


    return (
        <s-section heading="Trigger Customer welcome email">
            <s-paragraph>
                To send welcome email to Bytes and Magento customers, click the button below. This will trigger the welcome email to be sent to all customers who have signed up for your store with marketing permissions.
            </s-paragraph>

            {isSending && (
                <s-banner>Work in progress</s-banner>
            )}
          {result?.success && (
            <s-banner tone="success">
              Sent to {result.totalSent} customers successfully!
            </s-banner>
          )}

          {result?.error && (
            <s-banner tone="critical">
              Error: {result.error}
            </s-banner>
          )}


            <s-button onClick={handleSend}>
                Trigger Welcome Email
            </s-button>
        </s-section>
    )
}