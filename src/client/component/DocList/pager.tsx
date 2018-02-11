import * as React from 'react';
import { pure } from 'recompose';

function Pager(props: any) {

    const { matchCount, totalCount, page, perpage, onChange } = props;

    const nbpages = Math.ceil(matchCount / perpage);

    return (
        <div>
            <h3>
                {matchCount} doc{matchCount === 1 ? '' : 's'} matching
                out of {totalCount}.
            </h3>

            <p>
                Page {page} out of {nbpages}
                <span style={{ visibility: page > 1 ? 'visible' : 'hidden' }}>
                    &nbsp;<button onClick={() => onChange(page - 1)}>Prev &lt;</button>
                </span>
                &nbsp;
                {page < nbpages && (<span>&nbsp;<button onClick={() => onChange(page + 1)}>
                    Next &gt;
                </button></span>)}
            </p>
        </div>
    );
}

export default pure(Pager);
