import connectState from 'realtime-reactive/lib/client/state/connect';

import { ApplicationState } from '../../store/applicationstate';
import App from '../../component/App';
import { toggleConnected } from '../../store/action';

///////////////////////////////////////////////////////////////////////////////
// STATE HOC
///////////////////////////////////////////////////////////////////////////////

const mapStateToProps = (state: ApplicationState, props: any, dispatch: any) => {
    return {
        ...props,
        connected: state.connected,
        toggleConnected: () => dispatch(toggleConnected())
    };
};

const hoc = connectState(mapStateToProps);
export default hoc(App);
