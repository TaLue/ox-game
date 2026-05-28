import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(url = '/api/test', method = 'GET') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const req = { headers: {} as Record<string, string>, method, url } as unknown as Request;
  const res = { status } as unknown as Response;
  return {
    json,
    status,
    host: {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ArgumentsHost,
    req,
  };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  beforeEach(() => { filter = new HttpExceptionFilter(); });

  it('formats HttpException with standard error shape', () => {
    // SEC-05, SEC-08
    const { host, status, json } = makeHost('/api/games/1/move', 'POST');
    filter.catch(new HttpException('Position already taken', HttpStatus.CONFLICT), host);
    expect(status).toHaveBeenCalledWith(409);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('Position already taken');
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/games/1/move');
  });

  it('uses X-Correlation-Id header if present', () => {
    const { host, req, json } = makeHost();
    (req.headers as Record<string, string>)['x-correlation-id'] = 'my-trace-id';
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    expect(json.mock.calls[0][0].correlationId).toBe('my-trace-id');
  });

  it('returns 500 for non-HttpException errors', () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].statusCode).toBe(500);
  });

  it('extracts message and error from HttpException object response', () => {
    const { host, json } = makeHost();
    const exception = new HttpException(
      { statusCode: 400, message: 'Bad input', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Bad input');
    expect(body.error).toBe('Bad Request');
  });
});
