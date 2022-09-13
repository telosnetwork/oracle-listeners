const ecc = require("eosjs-ecc");
const { BigNumber, ethers, utils } = require("ethers");
const Listener = require("../Listener");
const ABI = { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "name": "requests", "outputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "address", "name": "caller_address", "type": "address"}, { "internalType": "uint256", "name": "caller_id",  "type": "uint256" }, { "internalType": "uint256", "name": "requested_at", "type": "uint256" }, { "internalType": "uint64", "name": "seed", "type": "uint64" }, { "internalType": "uint256", "name": "min", "type": "uint256" }, { "internalType": "uint256", "name": "max", "type": "uint256" }, { "internalType": "uint256", "name": "callback_gas", "type": "uint256" }, { "internalType": "address",  "name": "callback_address", "type": "address" }], "stateMutability": "view", "type": "function"}

const ACCOUNT_STATE_TABLE = "accountstate";
const EOSIO_EVM = "eosio.evm";

class RNGBridgeListener extends Listener {

    constructor(
        oracle,
        rpc,
        api,
        config,
        bridge
    ){
        super(oracle, rpc, api, config, bridge);
        const conf = config.scripts.listeners.rng.bridge;
        if(conf.check_interval_ms > 0){
            this.check_interval_ms = conf.check_interval_ms; // Override base interval
        }
    }

    async start() {
        await super.startStream("RNG Oracle Bridge", EOSIO_EVM, ACCOUNT_STATE_TABLE, this.bridge.eosio_evm_scope, false, async(data) => {
            if(this.counter == 11){
                await this.notify();
                this.counter = -1;
            }
            this.counter++;
        })
        // RPC TABLE CHECK
        await this.doTableCheck();
        setInterval(async () => {
            await this.doTableCheck();
        }, this.check_interval_ms)
    }

    async doTableCheck(){
        let table_counter = 0;
        // TODO: get array length with ethers, if > 0 call reqnotify();

    }
    async notify(){
        return await this.api.transact({
            actions: [{
                account: this.bridge.antelope_account,
                name: 'reqnotify',
                authorization: [{ actor: this.caller.name, permission: this.caller.permission }],
                data: {},
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 90,
        }).then(result => {
            this.log('\nCalled reqnotify()');
        }).catch(e => {
            this.log('\nCaught exception: ' + e);
        });
    }
}

module.exports = RNGBridgeListener;