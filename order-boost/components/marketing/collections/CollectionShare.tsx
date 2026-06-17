import { useFetcher } from "react-router";

type CampaignResult = {
  success?: boolean;
  message?: string;
  error?: string;
  eligibleProducts?: number;
  eligibleCustomers?: number;
  sentEmails?: number;
  failedEmails?: number;
};

const LATEST_PRODUCTS_INTENT = "send-latest-products-email";

export default function CollectionShare() {
  const fetcher = useFetcher<CampaignResult>();
  const isSending = fetcher.state === "submitting";
  const result = fetcher.data;

  const handleSend = () => {
    const formData = new FormData();
    formData.set("intent", LATEST_PRODUCTS_INTENT);

    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <s-section heading="Send latest products email">
      <s-paragraph>
        Send an email featuring products created in the last 5 days with the
        latest or featured tag.
      </s-paragraph>
      <s-paragraph tone="info">
        Note: It will send email only to verified customers who opted in to
        marketing emails.
      </s-paragraph>

      {isSending && <s-banner>Sending latest products email...</s-banner>}

      {result?.success && (
        <s-banner tone="success">
          {result.message ?? "Latest products email campaign completed."}
          {typeof result.sentEmails === "number" &&
            ` Sent ${result.sentEmails} email(s) to ${result.eligibleCustomers ?? 0} eligible customer(s) with ${result.eligibleProducts ?? 0} eligible product(s).`}
        </s-banner>
      )}

      {result && !result.success && (
        <s-banner tone="critical">
          {result.error ?? "Latest products email campaign failed."}
        </s-banner>
      )}

      {result?.success &&
        typeof result.failedEmails === "number" &&
        result.failedEmails > 0 && (
          <s-banner tone="warning">
            {result.failedEmails} email(s) failed to send.
          </s-banner>
        )}

      <s-button disabled={isSending} onClick={handleSend}>
        {isSending ? "Sending..." : "Send Latest Products Email"}
      </s-button>
    </s-section>
  );
}
