import React from "react";

type Option = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
};

export const PayerPlanSelector: React.FC<Props> = ({ value, onValueChange, options }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Payer Plan</label>
      <select
        className="w-full border border-border bg-card rounded-md p-2 shadow-sm"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
