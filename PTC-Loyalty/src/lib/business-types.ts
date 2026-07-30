/** Business categories offered at signup and editable by platform admins. */
export const BUSINESS_TYPES = [
  { value: "restaurant", label: "Nhà hàng" },
  { value: "cafe", label: "Quán café" },
  { value: "nail_salon", label: "Nail salon" },
  { value: "beauty_salon", label: "Beauty salon" },
  { value: "retail", label: "Cửa hàng bán lẻ" },
  { value: "supermarket", label: "Siêu thị" },
  { value: "service", label: "Trung tâm dịch vụ" },
  { value: "other", label: "Khác" },
] as const;

export type BusinessTypeValue = (typeof BUSINESS_TYPES)[number]["value"];

/** Human label for a stored `Business.type`, falling back to the raw value. */
export function businessTypeLabel(value: string): string {
  return BUSINESS_TYPES.find((t) => t.value === value)?.label ?? value;
}
