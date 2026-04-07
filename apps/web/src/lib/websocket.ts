/** WebSocket client for the local display server. */
export class DisplayWebSocket {
  private ws: WebSocket | null = null;

  connect(url: string): void {
    this.ws = new WebSocket(url);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
