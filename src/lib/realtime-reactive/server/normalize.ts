import { DocumentNode, FieldNode } from 'graphql';
import { SubscribedResource, Filter } from './types';

export default function normalizeQuerySubscription(ast: DocumentNode, variables: any):
    { queries: Array<SubscribedResource>, err: string | null } {

    const result: Array<SubscribedResource> = [];

    function respondError(err: string) {
        return {
            queries: [],
            err
        };
    }

    if (ast.definitions.length === 0) {
        return respondError('No definition found in query');
    }

    for (const q of ast.definitions) {
        if (q.kind !== 'OperationDefinition') {
            return respondError('Only "OperationDefinition"'
                + ' definitions are supported; received "' + q.kind + '" instead');
        }
    }

    if (ast.definitions.length > 1) {
        return respondError('Only one query definition supported per subscription');
    }

    const definition = ast.definitions[0];

    if (definition.kind !== 'OperationDefinition' || definition.operation !== 'query') {
        return respondError('Given definition has to be "query"');
    }

    if (definition.selectionSet.selections.length === 0) {
        return respondError('Selection set of query operation cannot be empty');
    }

    const queries = definition.selectionSet.selections;

    for (const q of queries) {

        if (q.kind !== 'Field') {
            return respondError('Fragments are not supported on queries"');
        }

        if (!q.selectionSet || q.selectionSet.selections.length === 0) {
            return respondError('Empty selections are not supported on queries"');
        }

        let nodeSelection: any = undefined;
        const aggregates: any = {};

        for (const sel of q.selectionSet.selections) {
            if (sel.kind !== 'Field') {
                return respondError('Fragments are not supported on queries"');
            }

            const name = sel.name.value;

            let nodes: any = null;

            if (name === 'nodes') {
                // nested hierarchy
                if (!sel.selectionSet || sel.selectionSet.selections.length === 0) {
                    return respondError('"nodes" prop on query cannot be requested empty');
                }

                const processNode = (field: FieldNode): any => {
                    const res = {
                        name: field.name.value,
                        alias: field.alias ? field.alias.value : field.name.value,
                    };

                    if (field.selectionSet) {
                        (res as any).subnodes =
                            field.selectionSet.selections.map(processNode);
                    }

                    return res;
                };

                nodes = sel.selectionSet.selections.map(processNode);
                nodeSelection = {
                    alias: sel.alias ? sel.alias.value : sel.name.value,
                    props: nodes,
                };
            } else if (name === 'totalCount') {
                aggregates.totalCount = {
                    alias: sel.alias ? sel.alias.value : sel.name.value,
                };
            } else {
                return respondError('Invalid prop "' + name + '" requested;'
                    + ' only "nodes" and "totalCount" are supported');
            }
        }

        const resourcename = q.name.value;

        const args = [];
        if (q.arguments) {
            for (const arg of q.arguments) {
                if (arg.kind !== 'Argument') {
                    return respondError('Invalid Argument type');
                }
    
                let value: any = null;
                let variable: string|undefined;
                let getter: (variables: any) => any;
                switch (arg.value.kind) {
                    case 'IntValue': {
                        value = parseInt(arg.value.value, 10);
                        getter = () => value;
                        break;
                    }
                    case 'FloatValue': {
                        value = parseFloat(arg.value.value);
                        getter = () => value;
                        break;
                    }
                    case 'StringValue': {
                        value = arg.value.value;
                        getter = () => value;
                        break;
                    }
                    case 'BooleanValue': {
                        value = arg.value.value;
                        getter = () => value;
                        break;
                    }
                    case 'NullValue': {
                        value = null;
                        getter = () => null;
                        break;
                    }
                    case 'Variable': {
                        variable = arg.value.name.value;
                        getter = (vars: any) => {
                            if (!(variable as string in vars)) { return undefined; }
                            return vars[variable as string];
                        };
                        break;
                    }
                    default: {
                        return respondError('Only scalar arguments and variables'
                            + ' are supported (got "' + arg.value.kind + '")');
                    }
                }
    
                args.push({
                    name: arg.name.value,
                    getter,
                });
            }
        }

        let sort: any;
        let offset: any;
        let limit: any;
        const filters: Array<Filter> = [];

        for (const arg of args) {
            switch (arg.name) {
                case 'sort': {
                    sort = arg;
                    break;
                }
                case 'offset': {
                    offset = arg;
                    break;
                }
                case 'limit': {
                    limit = arg;
                    break;
                }
                default: {
                    // value filter
                    filters.push(arg);
                }
            }
        }

        // On vérifie qu'un ordonnancement est défini
        // Et que la propriété ordonnancée fait partie des données sélectionnées
        let sortOptions: any;

        if (!sort) {
            if (nodeSelection !== undefined) {
                return respondError('A sort is required on every resource query selecting nodes');
            }
        } else {
            const sortParamValue = sort.getter(variables);

            if (!sortParamValue) {
                return respondError('The variable bound to the sort is required on every resource query');
            }

            const sortdir = (sortParamValue.toString()).charAt(0) === '-' ? -1 : 1;
            const sortprop = (sortParamValue.toString()).replace(/^[-\+]{1}/, '');

            // La propriété d'ordonnancement est-elle sélectionnée ?
            let sortSelected = false;
            if (nodeSelection) {
                for (const prop of nodeSelection.props) {
                    if (prop.name === sortprop) {
                        sortSelected = true;
                        break;
                    }
                }
            }

            if (!sortSelected) {
                return respondError('The "sort" property of a resource has to be selected by the resource query');
            }

            sortOptions = {
                prop: sortprop,
                dir: sortdir,
            };
        }

        result.push({
            name: resourcename,
            alias: q.alias ? q.alias.value : resourcename,
            aggregates,
            filters,
            sort: sortOptions,
            offset,
            limit,
            track: {
                totalCount: undefined,
                count: undefined,
                first: undefined,
                last: undefined,
            }
        });
    }

    return {
        queries: result,
        err: null,
    };
}
