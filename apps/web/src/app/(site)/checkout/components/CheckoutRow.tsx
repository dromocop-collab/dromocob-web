import s from "../checkout.module.css";

export default function CheckoutRow({
  label,
  val,
  strong,
}: {
  label: string;
  val: string;
  strong?: boolean;
}) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={`${s.rowVal} ${strong ? s.rowValStrong : ""}`}>
        {val}
      </span>
    </div>
  );
}