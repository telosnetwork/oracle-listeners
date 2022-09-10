const ecc = require("eosjs-ecc");
const HyperionStreamClient = require("@eosrio/hyperion-stream-client").default;
const fetch = require("node-fetch");
const Listener = require("../Listener");

const REQUESTS_TABLE = "rngrequests";

class RNGRequestListener extends Listener {

    constructor(
        oracle,
        rpc,
        api,
        config,
        bridge
    ){
        super(oracle, rpc, api, config, bridge);
        let conf = config.scripts.listeners.rng.request;
        if(conf.check_interval_ms){
            this.check_interval_ms = conf.check_interval_ms; // Override base interval
        }
        this.processing = [];
    }

    async start() {
        await this.startStream();
        await this.doTableCheck();
        setInterval(async () => {
            await this.doTableCheck();
        }, this.check_interval_ms)
    }

    async startStream() {
        if (typeof this.caller.signing_key === "undefined" ){
            this.log('/!\\ Signing key is undefined. Script will not try to sign.')
        }
        let getInfo = await this.rpc.get_info();
        let headBlock = getInfo.head_block_num;
        this.streamClient = new HyperionStreamClient(
            this.hyperion,
            {
                async: true,
                fetch: fetch,
            }
        );
        this.streamClient.lastReceivedBlock = headBlock;
        this.streamClient.onConnect = () => {
            this.streamClient.streamDeltas({
                code: this.oracle,
                table: REQUESTS_TABLE,
                scope: this.oracle,
                payer: "",
                start_from: headBlock,
                read_until: 0,
            });
        };

        this.streamClient.onData = async (data, ack) => {
            this.streamClient.lastReceivedBlock = data.block_num;
            if (data.content.present) await this.signRow(data.content.data);
            ack();
        };

        this.streamClient.connect(() => {
            this.log("Connected to Hyperion Stream for RNG Oracle Requests !");
        });

        // check lastReceivedBlock isn't too far from HEAD, else stop stream & start again
        let interval = setInterval(async () => {
            if(typeof this.streamClient.lastReceivedBlock !== "undefined" && this.streamClient.lastReceivedBlock !== 0){
                let getInfo = await this.rpc.get_info();
                if(this.max_block_diff < ( getInfo.head_block_num - this.streamClient.lastReceivedBlock)){
                    clearInterval(interval);
                    this.log("Restarting stream  for RNG Oracle Requests...");
                    this.streamClient.disconnect();
                    await this.startStream();
                }
            }
        }, this.check_interval_ms)
    }

    async doTableCheck() {
        this.log(`Doing table check for RNG Oracle Requests...`);
        const results = await this.rpc.get_table_rows({
            code: this.oracle,
            scope: this.oracle,
            table: REQUESTS_TABLE,
            limit: 1000,
            reverse: true
        });

        let count = 0;
        await results.rows.forEach(async (row) => {
            if(!row.sig2 || row.sig2 === '' ||  row.oracle2 === "eosio.null"){
                count++;
                await this.signRow(row);
                if(count > 25){
                    return ;
                }
            }
        });
        console.log(this.processing)
        this.log(`Done doing table check for RNG Oracle Requests ! `);
    }
    removeProcessingRequest(request_id){
        const index = this.processing.indexOf(request_id);
        if (index > -1) { this.processing.splice(index, 1);  }
    }
    async signRow(row) {
        if (this.processing.includes(row.request_id) || typeof this.caller.signing_key === "undefined" || row.oracle1 === this.caller.name || row.oracle2 === this.caller.name){
            return false;
        }
        this.processing.push(row.request_id);
        this.log(`Signing request_id: ${row.request_id}...`)
        try {
            const result = await this.api.transact(
                {
                    actions: [
                        {
                            account: this.oracle,
                            name: "submitrand",
                            authorization: [
                                {
                                    actor: this.caller.name,
                                    permission: this.caller.permission,
                                },
                            ],
                            data: {
                                request_id: row.request_id,
                                oracle_name: this.caller.name,
                                sig: ecc.signHash(row.digest, this.caller.signing_key),
                            },
                        },
                    ],
                },
                { blocksBehind: 10, expireSeconds: 60 }
            );
            this.log(`Signed request ${row.request_id}`);
            this.removeProcessingRequest(row.request_id);
            return result;
        } catch (e) {
            console.error(`Submitting signature failed: ${e}`);
            this.removeProcessingRequest(row.request_id);
            return false;
        }
    }
}

module.exports = RNGRequestListener;
