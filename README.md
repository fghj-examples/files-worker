# files-worker

The thumbnail worker of the [fghj](https://github.com/mlnja/fghj) `files`
example. It takes jobs off the Redis list `files:thumbnail-jobs`, renders a
thumbnail with sharp, puts it back in MinIO and tells `files-api` about it.

It shares Redis with `files-api` through `files-platform`'s `cache` flow, and
reaches MinIO through the **raw** zone: it never hands a URL to anyone, so it
skips the TLS proxy entirely. Compare `S3_ENDPOINT` here with the one in
`files-api`.

`debug: 9229` publishes Node's inspector. Its first jobs (the seed's sample
files) are taken off the queue as soon as it starts, so to step through
those, turn on halt at startup for it in the fghj UI.

`files-api` is only a runtime dependency (`required: false`): jobs wait in
Redis until both are up.

## The tutorial

This repo is the example the [fghj tutorial](https://fghj.mlops.ninja/tutorial/)
builds, one chapter at a time. Each chapter it appears in is a tag, `ch5`
to `ch7`, and `main` is the finished repo.
