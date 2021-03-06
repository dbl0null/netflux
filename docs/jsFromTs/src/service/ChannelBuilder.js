import { Subject } from 'rxjs/Subject';
import { channelBuilder } from '../proto';
import { WebSocketBuilder } from '../WebSocketBuilder';
import { Service } from './Service';
import { WebRTCBuilder } from './WebRTCBuilder';
const ME = {
    wsUrl: '',
    isWrtcSupport: false,
};
let request;
let response;
/**
 * It is responsible to build a channel between two peers with a help of `WebSocketBuilder` and `WebRTCBuilder`.
 * Its algorithm determine which channel (socket or dataChannel) should be created
 * based on the services availability and peers' preferences.
 */
export class ChannelBuilder extends Service {
    constructor(wc) {
        super(20, channelBuilder.Message, wc.serviceMessageSubject);
        this.wc = wc;
        this.pendingRequests = new Map();
        this.channelsSubject = new Subject();
        // Listen on Channels as RTCDataChannels if WebRTC is supported
        ME.isWrtcSupport = WebRTCBuilder.isSupported;
        if (ME.isWrtcSupport) {
            wc.webRTCBuilder.onChannelFromWebChannel()
                .subscribe((ch) => this.handleChannel(ch));
        }
        // Listen on Channels as WebSockets if the peer is listening on WebSockets
        WebSocketBuilder.listen().subscribe((url) => {
            ME.wsUrl = url;
            if (url) {
                wc.webSocketBuilder.onChannel.subscribe((ch) => this.handleChannel(ch));
            }
            // Update preconstructed messages (for performance only)
            const content = { wsUrl: url, isWrtcSupport: ME.isWrtcSupport };
            request = super.encode({ request: content });
            response = super.encode({ response: content });
        });
        // Subscribe to WebChannel internal messages
        this.onServiceMessage.subscribe((msg) => this.treatServiceMessage(msg));
    }
    get onChannel() {
        return this.channelsSubject.asObservable();
    }
    /**
     * Establish a `Channel` with the peer identified by `id`.
     */
    connectTo(id) {
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, {
                resolve: (ch) => {
                    this.pendingRequests.delete(id);
                    resolve(ch);
                }, reject: (err) => {
                    this.pendingRequests.delete(id);
                    reject(err);
                },
            });
            this.wc.sendToProxy({ recipientId: id, content: request });
        });
    }
    handleChannel(ch) {
        const pendReq = this.pendingRequests.get(ch.id);
        if (pendReq) {
            pendReq.resolve(ch);
        }
        else {
            this.channelsSubject.next(ch);
        }
    }
    treatServiceMessage({ channel, senderId, recipientId, msg }) {
        switch (msg.type) {
            case 'failed': {
                console.warn('treatServiceMessage ERROR: ', msg.failed);
                const pr = this.pendingRequests.get(senderId);
                if (pr !== undefined) {
                    pr.reject(new Error(msg.failed));
                }
                break;
            }
            case 'request': {
                const { wsUrl, isWrtcSupport } = msg.request;
                // If remote peer is listening on WebSocket, connect to him
                if (wsUrl) {
                    this.wc.webSocketBuilder.connectTo(wsUrl, senderId)
                        .then((ch) => this.handleChannel(ch))
                        .catch((reason) => {
                        if (ME.wsUrl) {
                            // Ask him to connect to me via WebSocket
                            this.wc.sendToProxy({ recipientId: senderId, content: response });
                        }
                        else {
                            // Send failed reason
                            this.wc.sendToProxy({
                                recipientId: senderId,
                                content: super.encode({ failed: `Failed to establish a socket: ${reason}` }),
                            });
                        }
                    });
                    // If remote peer is able to connect over RTCDataChannel, verify first if I am listening on WebSocket
                }
                else if (isWrtcSupport) {
                    if (ME.wsUrl) {
                        // Ask him to connect to me via WebSocket
                        this.wc.sendToProxy({ recipientId: senderId, content: response });
                    }
                    else if (ME.isWrtcSupport) {
                        this.wc.webRTCBuilder.connectOverWebChannel(senderId)
                            .then((ch) => this.handleChannel(ch))
                            .catch((reason) => {
                            // Send failed reason
                            this.wc.sendToProxy({
                                recipientId: senderId,
                                content: super.encode({ failed: `Failed establish a data channel: ${reason}` }),
                            });
                        });
                    }
                    else {
                        // Send failed reason
                        this.wc.sendToProxy({
                            recipientId: senderId,
                            content: super.encode({ failed: 'No common connectors' }),
                        });
                    }
                    // If peer is not listening on WebSocket and is not able to connect over RTCDataChannel
                }
                else if (!wsUrl && !isWrtcSupport) {
                    if (ME.wsUrl) {
                        // Ask him to connect to me via WebSocket
                        this.wc.sendToProxy({ recipientId: senderId, content: response });
                    }
                    else {
                        // Send failed reason
                        this.wc.sendToProxy({
                            recipientId: senderId,
                            content: super.encode({ failed: 'No common connectors' }),
                        });
                    }
                }
                break;
            }
            case 'response': {
                const { wsUrl } = msg.response;
                if (wsUrl) {
                    this.wc.webSocketBuilder.connectTo(wsUrl, senderId)
                        .then((ch) => this.handleChannel(ch))
                        .catch((reason) => {
                        this.pendingRequests.get(senderId)
                            .reject(new Error(`Failed to establish a socket: ${reason}`));
                    });
                }
                break;
            }
        }
    }
}
