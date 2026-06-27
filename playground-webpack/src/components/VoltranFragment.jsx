import React from "react";

export const VoltranFragment = ({ fragmentInfo, options }) => {
  return (
    <div
      style={{
        border: "1px dashed #6366f1",
        borderRadius: "8px",
        padding: "12px 16px",
        background: "#f5f3ff",
        minWidth: "200px",
      }}
    >
      <div style={{ fontSize: "11px", color: "#6366f1", fontWeight: 600, marginBottom: 4 }}>
        Voltran Fragment
      </div>
      <div style={{ fontSize: "13px", fontWeight: 500, color: "#1e1b4b" }}>
        {options?.componentTypeName ?? "Unknown"}
      </div>
      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: 2 }}>
        id: {fragmentInfo?.id}
      </div>
    </div>
  );
};
