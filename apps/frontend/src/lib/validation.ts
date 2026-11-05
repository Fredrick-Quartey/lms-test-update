/** Ghana numbers: 0XXXXXXXXX or +233XXXXXXXXX (mobile 02x/05x, landline 03x). Server re-validates. */
export const PHONE_RE = /^(?:\+233|0)[235]\d{8}$/;
export const cleanPhone = (p: string) => p.replace(/[\s-]/g, '');
