import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? uuidv4();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
        error = exception.message;
      } else {
        const body = resp as Record<string, unknown>;
        message = (body.message as string) ?? exception.message;
        error = (body.error as string) ?? 'Error';
      }
    } else {
      message = 'Internal server error';
      error = 'Internal Server Error';
      this.logger.error(exception, { correlationId });
    }

    // SEC-08: never log secrets; log correlationId for traceability
    this.logger.warn(`${status} ${req.method} ${req.url}`, { correlationId });

    res.status(status).json({
      statusCode: status,
      error,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
