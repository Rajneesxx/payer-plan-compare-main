import { type PayerPlan } from "@/constants/fields";

interface PayerPlanSelectorProps {
  value: PayerPlan;
  onValueChange: (value: PayerPlan) => void;
  options: { value: PayerPlan; label: string }[];
}

export const PayerPlanSelector = ({ value, onValueChange, options }: PayerPlanSelectorProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Payer Plan</label>
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value as PayerPlan)}
        className="w-full border border-border rounded-md p-2 bg-card"
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
