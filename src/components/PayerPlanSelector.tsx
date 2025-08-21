import { RadioGroup } from "@headlessui/react";
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
      <RadioGroup value={value} onChange={onValueChange} className="flex flex-col gap-2">
        {options.map((opt) => (
          <RadioGroup.Option
            key={opt.value}
            value={opt.value}
            className={({ active, checked }) =>
              `flex items-center gap-2 p-2 rounded-md cursor-pointer border ${
                checked ? "bg-primary/20 border-primary" : "border-border"
              }`
            }
          >
            {({ checked }) => (
              <>
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    checked ? "bg-primary border-primary" : "border-gray-400"
                  }`}
                >
                  {checked && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm font-medium">{opt.label}</span>
              </>
            )}
          </RadioGroup.Option>
        ))}
      </RadioGroup>
    </div>
  );
};
