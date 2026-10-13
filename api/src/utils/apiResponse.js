export const sendSuccess = (res, data, statusCode = 200) => {
  if (statusCode === 204) {
    return res.status(204).end();
  }

  return res.status(statusCode).json({ data });
};

export const sendPaginatedSuccess = (res, data, pagination) =>
  res.status(200).json({
    data,
    pagination: {
      offset: pagination.offset,
      limit: pagination.limit,
      total: pagination.total,
      hasMore: pagination.hasMore,
    },
  });
