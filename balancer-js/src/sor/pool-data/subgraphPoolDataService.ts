import { PoolDataService, SubgraphPoolBase } from '@balancer-labs/sor';
import { OrderDirection, Pool_OrderBy, SubgraphClient } from '../../subgraph/subgraph';
import { parseInt } from 'lodash';
import { getOnChainBalances } from './onChainData';
import { Provider } from '@ethersproject/providers';
import { Network } from '../../constants/network';
import { BalancerNetworkConfig, BalancerSdkSorConfig } from '../../types';

const NETWORKS_WITH_LINEAR_POOLS = [
    Network.MAINNET,
    Network.ROPSTEN,
    Network.RINKEBY,
    Network.GOERLI,
    Network.KOVAN,
];

export class SubgraphPoolDataService implements PoolDataService {
    constructor(
        private readonly client: SubgraphClient,
        private readonly provider: Provider,
        private readonly network: BalancerNetworkConfig,
        private readonly sorConfig: BalancerSdkSorConfig
    ) {}

    public async getPools(): Promise<SubgraphPoolBase[]> {
        const pools = this.supportsLinearPools
            ? await this.getLinearPools()
            : await this.getNonLinearPools();

        const mapped = pools.map((pool) => ({
            ...pool,
            poolType: pool.poolType || '',
            tokens: (pool.tokens || []).map((token) => ({
                ...token,
                weight: token.weight || null,
            })),
            totalWeight: pool.totalWeight || undefined,
            amp: pool.amp || undefined,
            expiryTime: pool.expiryTime ? parseInt(pool.expiryTime) : undefined,
            unitSeconds: pool.unitSeconds ? parseInt(pool.unitSeconds) : undefined,
            principalToken: pool.principalToken || undefined,
            baseToken: pool.baseToken || undefined,
        }));

        if (this.sorConfig.fetchOnChainBalances === false) {
            return mapped;
        }

        return getOnChainBalances(
            mapped,
            this.network.multicall,
            this.network.vault,
            this.provider
        );
    }

    private get supportsLinearPools() {
        return NETWORKS_WITH_LINEAR_POOLS.includes(this.network.chainId);
    }

    private async getLinearPools() {
        const { pools } = await this.client.SubgraphPools({
            where: { swapEnabled: true },
            orderBy: Pool_OrderBy.TotalLiquidity,
            orderDirection: OrderDirection.Desc,
        });

        return pools;
    }

    private async getNonLinearPools() {
        const { pools } = await this.client.SubgraphPoolsWithoutLinear({
            where: { swapEnabled: true },
            orderBy: Pool_OrderBy.TotalLiquidity,
            orderDirection: OrderDirection.Desc,
        });

        return pools;
    }
}
