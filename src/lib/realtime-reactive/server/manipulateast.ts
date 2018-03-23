import { visit, ASTNode } from 'graphql';

export default function pruneGQLQuery(ast: ASTNode, { removeResources, keepProps }:
    { removeResources?: Array<string>, keepProps?: any } = {}): ASTNode {

    if (!removeResources) { removeResources = []; }
    if (!keepProps) { keepProps = []; }

    const context: {
        resource?: string,
        propPath: Array<string>
    } = {
        propPath: [],
    };

    const usedVariables: Array<string> = [];

    const prunedAST = visit(ast, {
        enter(node: ASTNode, key: any, parent: any, path: any, ancestors: any) {

            const depth = ancestors.length;

            if (depth === 4) {
                if (node.kind === 'Field') {
                    const resourceAlias = node.alias ? node.alias.value : node.name.value;
                    context.resource = resourceAlias;
                    context.propPath = [];

                    if (!shouldKeepResource(resourceAlias, removeResources)) {
                        context.resource = undefined;
                        return null;
                    }
                }
            } else if (depth >= 7) {
                if (node.kind === 'Field') {
                    const propName = node.name.value;
                    context.propPath.push(propName);

                    if (!shouldKeepProp(context.resource as string, context.propPath, keepProps)) {
                        context.propPath.pop();
                        return null;
                    }
                } else if (node.kind === 'Variable') {
                    usedVariables.push(node.name.value);
                }
            }

            return;
        },
        leave(node: ASTNode, key: any, parent: any, path: any, ancestors: any) {
            const depth = ancestors.length;
            if (depth === 4) {
                if (node.kind === 'Field') {
                    context.resource = undefined;
                    context.propPath = [];

                    if (!node.selectionSet || node.selectionSet.selections.length === 0) {
                        return null;
                    }
                }
            } else if (depth >= 7) {
                if (node.kind === 'Field') {
                    context.propPath.pop();

                    if (node.selectionSet && node.selectionSet.selections.length === 0) {
                        return null;
                    }
                }
            }

            return;
        }
    });

    // console.log('usedVariables', usedVariables);

    return visit(prunedAST, {
        enter(node: ASTNode, key: any, parent: any, path: any, ancestors: any) {

            // const depth = ancestors.length;

            if (node.kind === 'VariableDefinition') {
                if (usedVariables.indexOf(node.variable.name.value) === -1) {
                    return null;
                }
            }

            return;
        },
    });
}

function shouldKeepResource(resourceName: string, removeResources: Array<string>): boolean {
    return removeResources.indexOf(resourceName) === -1;
}

function shouldKeepProp(resourceName: string, proppath: Array<string>, keepProps: Array<string>): boolean {

    if (!(resourceName in keepProps)) {
        return true;
    }

    const kept = keepProps[resourceName];
    const prop = proppath.join('.');

    // we have to check that this prop does not have nested properties kept
    for (const keptprop of kept) {
        if ((keptprop + '.').indexOf(prop + '.') > -1) { return true; }
        if ((prop + '.').indexOf(keptprop + '.') > -1) { return true; }
    }

    return false;
}