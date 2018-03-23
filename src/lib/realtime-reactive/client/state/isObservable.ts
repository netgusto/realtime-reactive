import symbolObservable from 'symbol-observable';

export default (value: any ): boolean => {
    return Boolean(value && value[symbolObservable] && value === value[symbolObservable]());
};
