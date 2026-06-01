ARG GO_VERSION=1.25.1

FROM golang:${GO_VERSION}-alpine AS builder

WORKDIR /app
COPY . .

RUN go mod download
RUN go build -o server .

FROM alpine:latest
WORKDIR /root/

COPY --from=builder /app/server .

EXPOSE 4001

CMD ["./server", "--host", "0.0.0.0:4001"]
