/// <mls shortName="aura" project="102020" enhancement="_blank" />

const pendingRequests: Record<string, any> = {};

export class Aura {

    private channel?: BroadcastChannel;
    private mode: 'develpoment' | 'production' = 'production';
    public running: boolean = false;

    public open(name = 'collab') {
        if (this.running) return this;
        this.channel = new BroadcastChannel(name);
        return this;
    }

    public listen(mode: 'develpoment' | 'production' = 'production') {
        if (this.running) return this;
        if (!this.channel) throw new Error('Channel not opened');
        this.mode = mode;
        this.channel.onmessage = (event) => {
            if (event.data.type !== "fetch-response") return;
            const resolve = pendingRequests[event.data.id];
            if (!resolve) return;
            delete pendingRequests[event.data.id];

            resolve(new Response(event.data.body, {
                status: event.data.status,
                headers: event.data.headers
            }));
        };

        this.running = true;

        return this;
    }

    public async send(url: string, options: any): Promise<Response> {
        console.info({send: url})
        return new Promise((resolve, reject) => {

            if (!this.channel) {
                reject(new Error('Channel not opened'));
                return;
            }

            if (this.mode === 'production') {
                reject(new Error('Not prepared yet'));
                return;
            }

            const id: string = crypto.randomUUID();
            pendingRequests[id] = resolve;
            const server = url.split('/').shift();
            const opt = {
                type: "fetch-request",
                id: id,
                url,
                server,
                options: JSON.stringify(options)

            }

            this.channel.postMessage(opt);
        });
    }

    public close() {
        this.channel?.close();
        this.channel = undefined;
        return this;
    }
}

export interface RequestMsgBase {
    type: "fetch-request",
    server: string,
    url: string,
    id: string,
    options: string,
    headers: any

}

export interface ResponseMsgBase {
    type: "fetch-response",
    id: string,
    body: string,
    status: number,
    headers: any
}
