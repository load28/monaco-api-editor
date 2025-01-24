import { forEach, fromValue, map, pipe, Source } from "wonka";

const stream1 = pipe(
  fromValue(10),
  map((v) => v + 1),
);

const print = <T>(data: Source<T>) =>
  pipe(
    data,
    forEach((v) => console.log(v)),
  );

print(stream1);
