import * as PropTypes from 'prop-types';

import { Observable } from 'rxjs';

import DocList from '../../component/DocList';

import connectState from '../../../lib/realtime-reactive/client/state/connect';
import connectData from '../../../lib/realtime-reactive/client/data/connect';

import { sortList, browsePage, filterRank, log } from '../../store/action';

///////////////////////////////////////////////////////////////////////////////
// DATA HOC
///////////////////////////////////////////////////////////////////////////////

const observeQuery = (props: any, context: any, variables: any): Promise<Observable<any>> => {

    const { subscribeQuery } = context;
    const { log: doLog } = props;

    return subscribeQuery({
        query: `
            query(
                $sort: String!, $limit: Int!, $offset: Int!,
                $rank: ScalarResourceFilter, $firstname: ScalarResourceFilter
            ) {

                docs(sort: $sort, limit: $limit, offset: $offset, rank: $rank, firstname: $firstname) {
                    matchCount: totalCount
                    nodes {
                        id
                        rank
                        firstname
                        lastname
                        color
                    }
                }

                alldocs: docs {
                    totalCount
                }
            }
        `,
        variables,
    })
    .then((obs: Observable<any>) => {

        doLog('Subscribed to query');

        return obs.map((update: any) => {
            const hasNodes = update.data.docs && update.data.docs.nodes;

            doLog((hasNodes ? 'full' : 'partial') + ' update (' + JSON.stringify(update).length + ' bytes)');

            return {
                docs: update.data.docs ? update.data.docs.nodes : undefined,
                matchCount: update.data.docs ? update.data.docs.matchCount : undefined,
                totalCount: update.data.alldocs.totalCount,
            };
        });
    });
};

const dataHydratedList = connectData({
    observeQuery,
    mapPropsToVariables: (props: any): any => {
        
        let rankFilter = { };

        switch (props.rank) {
            // Filters are structured as expected by the ScalarResourceFilter GraphQL type
            case 'top': rankFilter = { rank: { operator: 'gte', value: 90000 } }; break;
            case 'bottom': rankFilter = { rank: { operator: 'lte', value: 10000 } }; break;
            default: { /**/ }
        }

        return {
            sort: props.sort,
            limit: props.limit,
            offset: (props.page - 1) * props.limit,
            ...rankFilter,
        };
    },
    requiredContext: {
        subscribeQuery: PropTypes.func.isRequired,
    }
})(DocList);

///////////////////////////////////////////////////////////////////////////////
// STATE HOC
///////////////////////////////////////////////////////////////////////////////

const mapStateToProps = (state: any, props: any, dispatch: any) => {
    return {
        ...props,

        sort: state.sort,
        limit: 15,
        page: state.page,
        rank: state.rank,

        // Wiring actions
        sortList: (sort: string) => dispatch(sortList(sort)),
        browsePage: (page: number) => dispatch(browsePage(page)),
        filterRank: (rank: string) => dispatch(filterRank(rank)),
        log: (msg: string) => dispatch(log(msg)),
    };
};

export default connectState(mapStateToProps)(dataHydratedList);
