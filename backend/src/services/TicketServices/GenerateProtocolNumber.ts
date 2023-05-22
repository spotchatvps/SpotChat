import moment from "moment";

function leftFillNum(num, targetLength) {
  return num.toString().padStart(targetLength, 0);
}

export function GenerateProtocolNumber(num: number) {
  const numLeft = leftFillNum(num, 15);
  const prefix = "SAC" + moment().format("YYYYMMDDHHmmss");
  return `${prefix}${numLeft}`;
}
