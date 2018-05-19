import * as React from 'react';
import { pure } from 'recompose';
import * as contrast from 'contrast';

export interface Props {
    item: any;
}

function ListItem(props: Props) {
    const { item } = props;

    const textColor = contrast(item.color) === 'light' ? 'black' : 'white';

    return (
        <p style={{ backgroundColor: item.color, color: textColor, padding: '5px' }}>
            {item.rank} &mdash; <strong>{item.firstname}</strong> {item.lastname.toUpperCase()}
        </p>
    );
}

export default pure(ListItem);