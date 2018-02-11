import * as React from 'react';
import cx from 'classnames';
import { pure } from 'recompose';

import './index.css';

export interface Props {
    item: any;
    selected: boolean;
    onSelect: (id: string) => void;
}

function ListItem(props: Props) {
    const { item, selected, onSelect } = props;

    return (
        <p className={cx({ selected })}>
            <button onClick={() => onSelect(item.id)}>🎯</button> 
            &nbsp;{item.rank} &mdash; {item.firstname} {item.lastname.toUpperCase()}
        </p>
    );
}

export default pure(ListItem);