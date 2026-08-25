"use client";

import styles from "./styles/removeConfirmModal.module.css";

type Locale = "tr" | "en";

type Props = {
  open: boolean;
  loc: Locale;
  confirmBox: {
    open: boolean;
    type: "cart" | "wish" | null;
    id: string;
    title: string;
    image?: string;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RemoveConfirmModal({ open, loc, confirmBox, onClose, onConfirm }: Props) {
  if (!open || !confirmBox) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.kicker}>
          {confirmBox.type === "cart"
            ? loc === "en" ? "Remove from cart" : "Sepetten kaldır"
            : loc === "en" ? "Remove from wishlist" : "Favorilerden kaldır"}
        </div>

        <h3 className={styles.title}>
          {loc === "en"
            ? "Are you sure?"
            : "Emin misin?"}
        </h3>

        <div className={styles.product}>
          <div className={styles.thumb}>
            {confirmBox.image ? <img src={confirmBox.image} alt={confirmBox.title} /> : <div className={styles.thumbPh}>DROMOCOB</div>}
          </div>
          <div className={styles.productName}>{confirmBox.title}</div>
        </div>

        <div className={styles.actions}>
          <button className={styles.ghostBtn} onClick={onClose} type="button">
            {loc === "en" ? "No, keep it" : "Hayır, kalsın"}
          </button>
          <button className={styles.dangerBtn} onClick={onConfirm} type="button">
            {loc === "en" ? "Yes, remove" : "Evet, kaldır"}
          </button>
        </div>
      </div>
    </div>
  );
}