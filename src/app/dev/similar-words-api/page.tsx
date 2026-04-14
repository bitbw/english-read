import { notFound } from "next/navigation";
import { SimilarWordsApiTestClient } from "./similar-words-api-test-client";

export default function SimilarWordsApiTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <SimilarWordsApiTestClient />;
}
