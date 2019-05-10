### MetaMask light client testing container

MetaMask currently relies on centralized infrastructure.
We've begun a long journey to turn MetaMask into a light client and bridge this network with the Ethereum mainnet.

In order to achieve this goal we've created a testing container for deploying p2p experiments in real world environments. These experiments will help us tweak critical p2p components such as peering strategy, state shard distribution, and global pub-sub.

If you would have any questions or would like to propose an experiment, please open an issue.

### Development

in separate terminal tabs:
```
npm start
npm run server
npm run swarm
```

- see `secret` printed out by `npm run server`'s `telemetry` process.
- open `http://localhost:9966/?admin=SECRET` with your secret