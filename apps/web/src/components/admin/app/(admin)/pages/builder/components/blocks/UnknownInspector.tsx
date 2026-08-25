"use client";

import styles from "./UnknownInspector.module.css";

type Props = {
  block: Record<string, any>;
};

export default function UnknownInspector({ block }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.kicker}>Unknown Block</div>
      <h3 className={styles.title}>Bu blok için özel arayüz yok</h3>
      <p className={styles.desc}>
        Dünya yıkılmadı. Bu blok tipi için henüz inspector yazılmamış. JSON görünümü aşağıda.
      </p>

      <pre className={styles.pre}>{JSON.stringify(block, null, 2)}</pre>
    </div>
  );
}