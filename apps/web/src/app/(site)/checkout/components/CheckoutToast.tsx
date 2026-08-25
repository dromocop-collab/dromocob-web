import s from "../checkout.module.css";

export default function CheckoutToast({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className={s.addrToast} role="status" aria-live="polite">
      <span className={s.addrToastIcon}>✓</span>
      <span>{message}</span>
    </div>
  );
}