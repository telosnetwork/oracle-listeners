# Telos Oracle Scripts

## Requirement

This repository requires NodeJS 14+, NPM and PM2

## Install

```
git clone https://github.com/telosnetwork/oracle-listeners
cd oracle-listeners
npm install
sudo npm install pm2 -g
```

## Configure

The values configured in the sample are for testnet, change to mainnet where appropriate

```
cp config.yml.sample config.yml
vi config.yml 
```

### > Antelope

### > EVM

### > Listeners

####   Delphi Bridge Listener

####   RNG Bridge Listener

####   RNG Oracle Request Listener

####   Gas Bridge Listener

### > Updaters

####   Delphi Updater

This updater supports 2 methods: `http` and `file`. Follow the steps below to configure them

```
cp config.yml.sample config.yml
vi config.yml 
```

## Run

```
pm2 start index.js --name oracle-listeners
```
