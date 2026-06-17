import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useEffect, useRef, useState} from "preact/hooks";

const GST_METAFIELD = {
  namespace: "$app",
  key: "gstNumber",
};

const GST_VALIDATION_DELAY = 800;
const GST_NUMBER_PATTERN = /^[0-9A-Z]{15}$/;

function getGstValidationEndpoint() {
  const env = typeof process !== "undefined" ? process.env : {};

  if (env.SHOPIFY_APP_URL) {
    return `${env.SHOPIFY_APP_URL.replace(/\/$/, "")}/api/gst-validate`;
  }

  return "";
}

// 1. Export the extension
export default async () => {
  render(<Extension />, document.body)
};

function Extension() {
  const [hasGstNumber, setHasGstNumber] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [validationStatus, setValidationStatus] = useState("idle");
  const [validationMessage, setValidationMessage] = useState("");
  const [gstUserName, setGstUserName] = useState("");
  const validationRequestId = useRef(0);

  const isGstRequiredButInvalid =
    hasGstNumber && validationStatus !== "valid";

  function onCheckboxChange(event) {
    const isChecked = Boolean(event.target?.checked);

    setHasGstNumber(isChecked);

    if (!isChecked) {
      setGstNumber("");
      setGstUserName("");
      setValidationStatus("idle");
      setValidationMessage("");
      void removeGstMetafield();
    }
  }

  function onGstNumberInput(event) {
    const nextGstNumber = event.target.value.trim().toUpperCase();

    setGstNumber(nextGstNumber);
    setGstUserName("");
    setValidationMessage("");
    setValidationStatus(nextGstNumber ? "validating" : "idle");
  }

  async function removeGstMetafield() {
    if (!shopify.instructions.value.metafields.canDeleteCartMetafield) {
      return;
    }
    console.log("removing meta field");
    await shopify.applyMetafieldChange({
      type: "removeCartMetafield",
      namespace: GST_METAFIELD.namespace,
      key: GST_METAFIELD.key,
    });
  }

  async function saveGstMetafield(validGstNumber) {
    console.log("add meta field")
    const result = await shopify.applyMetafieldChange({
      type: "updateCartMetafield",
      metafield: {
        namespace: GST_METAFIELD.namespace,
        key: GST_METAFIELD.key,
        value: validGstNumber,
        type: "single_line_text_field",
      },
    });

    if (result.type === "error") {
      throw new Error(result.message);
    }
  }

  async function validateGstNumber(validatingGstNumber) {
    const endpoint = getGstValidationEndpoint();

    // if (!endpoint) {
    //   throw new Error("GST validation endpoint is not configured.");
    // }

    const sessionToken = await shopify.sessionToken.get();
    const response = await fetch('https://fantasy-artwork-artificial-preference.trycloudflare.com/api/gst-validate', {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gstNumber: validatingGstNumber }),
    });
    const jsonResponse = await response.json();

    if (!response.ok) {
      throw new Error(jsonResponse.error || "GST number validation failed.");
    }
    if (jsonResponse.valid === true) {
        setGstUserName(jsonResponse.lgnm);
    }
    return jsonResponse.valid === true;
  }

  function getGstFieldError() {
    if (!hasGstNumber) {
      return undefined;
    }

    if (validationStatus === "invalid") {
      return "Enter a valid GST number.";
    }

    if (validationStatus === "error") {
      return validationMessage || "GST number validation failed. Try again.";
    }

    return undefined;
  }

  function getGstFieldIcon() {
    if (validationStatus === "validating") {
      return "clock";
    }

    if (validationStatus === "valid") {
      return "check-circle";
    }

    if (validationStatus === "invalid" || validationStatus === "error") {
      return "x-circle";
    }

    return undefined;
  }

  useEffect(() => {
    let teardownInterceptor;

    shopify.buyerJourney
      .intercept(({canBlockProgress}) => {
        if (!isGstRequiredButInvalid) {
          return {behavior: "allow"};
        }

        if (!canBlockProgress) {
          return {behavior: "allow"};
        }

        return {
          behavior: "block",
          reason: "GST number is required and must be valid.",
          errors: [
            {
              message:
                validationStatus === "validating"
                  ? "Please wait while we validate your GST number."
                  : "Enter a valid GST number or uncheck the GST number option.",
            },
          ],
        };
      })
      .then((teardown) => {
        teardownInterceptor = teardown;
      });

    return () => {
      teardownInterceptor?.();
    };
  }, [isGstRequiredButInvalid, validationStatus]);

  useEffect(() => {
    if (!hasGstNumber) {
      return;
    }

    if (!gstNumber) {
      validationRequestId.current += 1;
      void removeGstMetafield();
      return;
    }

    if (!GST_NUMBER_PATTERN.test(gstNumber)) {
      validationRequestId.current += 1;
      setValidationStatus("invalid");
      void removeGstMetafield();
      return;
    }

    const requestId = validationRequestId.current + 1;
    validationRequestId.current = requestId;
    setValidationStatus("validating");

    const timeoutId = setTimeout(async () => {
      try {
        const isValid = await validateGstNumber(gstNumber);

        if (validationRequestId.current !== requestId) {
          return;
        }

        if (!isValid) {
          setValidationStatus("invalid");
          await removeGstMetafield();
          return;
        }

        await saveGstMetafield(gstNumber);

        if (validationRequestId.current === requestId) {
          setValidationStatus("valid");
          setValidationMessage("");
        }
      } catch (error) {
        if (validationRequestId.current !== requestId) {
          return;
        }

        setValidationStatus("error");
        setValidationMessage(
          error instanceof Error ? error.message : "GST number validation failed.",
        );
        await removeGstMetafield();
      }
    }, GST_VALIDATION_DELAY);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [gstNumber, hasGstNumber]);

  // 2. Check instructions for feature availability
  if (!shopify.instructions.value.metafields.canSetCartMetafields) {
    return (
      <s-banner heading="gst-number" tone="warning">
        {shopify.i18n.translate("metafieldChangesAreNotSupported")}
      </s-banner>
    );
  }

  // 3. Render a UI
  return (
    <s-stack gap="base">
      <s-banner>
        <s-stack>
          <s-checkbox
            checked={hasGstNumber}
            onChange={onCheckboxChange}
            label={shopify.i18n.translate("doYouHaveGstNumber")}
          />
        </s-stack>
      </s-banner>

      {hasGstNumber && (
        <s-stack gap="base">
          <s-text-field
            error={getGstFieldError()}
            icon={getGstFieldIcon()}
            label="Enter GST Number"
            onInput={onGstNumberInput}
            value={gstNumber}
          />

          {validationStatus === "validating" && (
            <s-stack direction="inline" gap="small-200">
              <s-spinner accessibilityLabel="Validating GST number" size="small" />
              <s-text>Validating GST number...</s-text>
            </s-stack>
          )}

          {validationStatus === "valid" && (
            <s-text tone="success">{gstUserName}</s-text>
          )}
        </s-stack>
      )}
    </s-stack>
  );

}
