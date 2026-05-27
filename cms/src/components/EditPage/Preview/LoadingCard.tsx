import type { FC } from 'react';
import { SyncOutlined } from "@ant-design/icons";

const LoadingCard: FC = () => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 320,
    width: "100%",
    borderRadius: 8,
    border: "2px dashed #2a4a5a",
    backgroundColor: "#132230",
  }}>
    <SyncOutlined spin style={{ fontSize: 28, color: "#7EB3BC" }} />
    <span style={{ color: "#7EB3BC", fontWeight: 500, fontSize: 14 }}>
      Laddar förhandsvisning...
    </span>
  </div>
);

export default LoadingCard;
