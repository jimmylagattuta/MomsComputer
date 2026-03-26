declare module "@rails/actioncable" {
  export type Cable = any;
  export function createConsumer(url: string): Cable;
}