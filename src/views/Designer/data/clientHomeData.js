export function getClientHomeRuntimeData({news=[],events=[]}={}) {
  return {
    news: news.filter((item) => item.visible !== false),
    events,
  };
}
