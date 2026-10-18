"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { useStorefront } from "./storefront-provider";
import { loadRazorpay } from "@/utils/razorpay-client";

export function ResumePaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { clearCart } = useStorefront();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resumePayment() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) throw new Error("Razorpay Checkout could not be loaded.");
      const response = await fetch("/api/checkout/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json() as {
        error?: string;
        order?: { id: string; order_number: string };
        razorpay?: {
          keyId: string;
          orderId: string;
          amount: number;
          currency: string;
          name: string;
          description: string;
          prefill: { name: string; email: string };
        };
      };
      if (!response.ok || !result.order || !result.razorpay) {
        throw new Error(result.error ?? "This payment session could not be resumed.");
      }
      let verificationStarted = false;
      const checkout = new window.Razorpay({
        key: result.razorpay.keyId,
        amount: result.razorpay.amount,
        currency: result.razorpay.currency,
        name: result.razorpay.name,
        description: result.razorpay.description,
        order_id: result.razorpay.orderId,
        prefill: result.razorpay.prefill,
        handler: (paymentResult) => {
          verificationStarted = true;
          void (async () => {
            try {
              const verification = await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: result.order?.id, ...paymentResult }),
              });
              const verificationResult = await verification.json() as { error?: string; verified?: boolean };
              if (!verification.ok || verificationResult.verified !== true) {
                throw new Error(verificationResult.error ?? "Payment verification is still processing. Do not pay again.");
              }
              clearCart();
              router.replace(`/order-confirmation?ref=${encodeURIComponent(result.order?.order_number ?? "")}`);
            } catch (cause) {
              console.error("Could not verify resumed Razorpay payment:", cause);
              setError(cause instanceof Error ? cause.message : "Payment verification is still processing.");
              setBusy(false);
              router.refresh();
            }
          })();
        },
        modal: {
          ondismiss: () => {
            if (verificationStarted) return;
            setBusy(false);
            setError("Payment is still pending. You can resume this same payment session without creating another order.");
          },
        },
      });
      checkout.on("payment.failed", (event) => {
        setError(event.error?.description ?? "Razorpay could not complete this payment. You can try this order again.");
      });
      checkout.open();
    } catch (cause) {
      console.error("Could not resume Razorpay payment:", cause);
      setError(cause instanceof Error ? cause.message : "This payment session could not be resumed.");
      setBusy(false);
    }
  }

  return (
    <div className="sb-resume-payment">
      <button className="sb-button sb-button-primary" disabled={busy} onClick={() => void resumePayment()} type="button">
        {busy ? "Payment open…" : "Resume payment"} {!busy && <Icon name="arrow" size={16} />}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
