import { Request, Response, NextFunction } from 'express';

/**
 * Async handler to wrap controller functions and avoid repetitive try-catch blocks
 */
const asyncHandler = (requestHandler: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
    };
};

export { asyncHandler };
