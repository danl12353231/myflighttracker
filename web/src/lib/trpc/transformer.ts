import SuperJSON from 'superjson';

export const transformer = {
  input: {
    serialize: (object: unknown) => SuperJSON.stringify(object),
    deserialize: (object: string) => SuperJSON.parse(object),
  },
  output: {
    serialize: (object: unknown) => SuperJSON.stringify(object),
    deserialize: (object: string) => SuperJSON.parse(object),
  },
};
