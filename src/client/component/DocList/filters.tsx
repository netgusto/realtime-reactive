import * as React from 'react';
import { pure } from 'recompose';

function Filters(props: any) {

    const { sort, rank, onChangeSort, onChangeRank } = props;

    return (
        <div>
            <p>
                Sort: <select value={sort} onChange={e => onChangeSort(e.target.value)}>
                    <optgroup label="Rank">
                        <option value="-rank">Rank, DESC</option>
                        <option value="rank">Rank, ASC</option>
                    </optgroup>
                    <optgroup label="First name">
                        <option value="-firstname">First name, DESC</option>
                        <option value="firstname">First name, ASC</option>
                    </optgroup>
                    <optgroup label="Last name">
                        <option value="-lastname">Last name, DESC</option>
                        <option value="lastname">Last name, ASC</option>
                    </optgroup>
                </select>
            </p>
            <p>
                Rank: <select value={rank} onChange={e => onChangeRank(e.target.value)}>
                    <option value="top">Top 10%</option>
                    <option value="all">All</option>
                    <option value="bottom">Bottom 10%</option>
                </select>
            </p>
        </div>
    );
}

export default pure(Filters);
