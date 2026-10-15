export const guestAmexTestCard = {
  brand: "amex",
  number: "370000000000002",
  issuingCountry: "NL",
  expiryMonth: "03",
  expiryYear: "2030",
  securityCode: "7373",
} as const;

export const guestAmexTestCardWithoutSecurityCode = {
  ...guestAmexTestCard,
  number: "370000000100018",
  securityCode: "",
} as const;
