export {}

declare global {
  interface Window {
    __PAPERT__?: {
      updaterEnabled?: boolean
    }
  }
}
