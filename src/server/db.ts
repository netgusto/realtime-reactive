import * as faker from 'faker';
import * as loki from 'lokijs';

import { Doc } from './types';

export function generateRandomDoc(): Doc {
    return {
        id: faker.random.uuid(),
        firstname: faker.name.firstName(),
        lastname: faker.name.lastName(),
        rank: faker.random.number(100000),
    } as Doc;
}

export function connectMockDB() {

    // These docs to fill the DB before realtime updates start
    const initialData: Array<Doc> = [];
    for (let k = 0; k < 100; k++) {
        initialData.push(generateRandomDoc());
    }

    const db = new loki('db.json');

    const docs = db.addCollection('docs', {
        unique: ['id'],
        indices: ['id', 'rank', 'firstname', 'lastname'],
    });

    docs.insert(initialData as any);

    return db;
}