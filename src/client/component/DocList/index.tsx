import * as React from 'react';
import { pure } from 'recompose';

import DocListItem from '../DocListItem';
import Filters from './filters';
import Pager from './pager';

export interface Props {
    docs: Array<any>;
    matchCount: number;
    totalCount: number;
    selectedDoc?: string;
    sort: string;
    rank: string;
    limit: number;
    page: number;

    selectDoc: Function;
    sortList: Function;
    filterRank: Function;
    browsePage: Function;
}

function DocList(props: Props) {

    const { docs, selectedDoc } = props;
    const { matchCount, totalCount, sort, limit, page, rank } = props;

    // Actions
    const { selectDoc, sortList, browsePage, filterRank } = props;

    return (
        <div>
            <Filters sort={sort} onChangeSort={sortList} rank={rank} onChangeRank={filterRank} />
            <Pager
                matchCount={matchCount}
                totalCount={totalCount}
                page={page}
                perpage={limit}
                onChange={browsePage}
            />

            <hr />

            {docs && docs.map((item: any) => (
                <DocListItem
                    key={item.id}
                    item={item}
                    selected={item.id === selectedDoc}
                    onSelect={() => selectDoc(item.id)}
                />
            ))}

        </div>
    );
}

export default pure(DocList);
