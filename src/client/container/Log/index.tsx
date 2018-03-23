import connectState from '../../../lib/realtime-reactive/client/state/connect';

import { ApplicationState } from '../../store/applicationstate';
import Log from '../../component/Log';

///////////////////////////////////////////////////////////////////////////////
// STATE HOC
///////////////////////////////////////////////////////////////////////////////

const mapStateToProps = (state: ApplicationState, props: any, dispatch: any) => {
    return {
        ...props,
        log: state.log,
    };
};

export default connectState(mapStateToProps)(Log);
