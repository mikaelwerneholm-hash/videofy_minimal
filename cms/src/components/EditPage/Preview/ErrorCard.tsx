import type { FC } from 'react';
import { WarningOutlined } from "@ant-design/icons";

interface Props {
  errorMessage: string;
}

const ErrorCard: FC<Props> = ({ errorMessage }) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 320,
    width: "100%",
    borderRadius: 8,
    border: "2px dashed #7a3535",
    backgroundColor: "#1f1515",
    padding: 24,
  }}>
    <WarningOutlined style={{ fontSize: 28, color: "#dc4446" }} />
    <span style={{ color: "#f89f9a", fontWeight: 600, fontSize: 14, textAlign: "center" }}>
      Något gick fel med förhandsvisningen.
    </span>
    <span style={{ color: "#a07070", fontSize: 13, textAlign: "center", maxWidth: 320 }}>
      {errorMessage}
    </span>
  </div>
);

export default ErrorCard;
