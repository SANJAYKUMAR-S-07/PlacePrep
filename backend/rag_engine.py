import os
import io
import json
import pickle
import numpy as np
from dotenv import load_dotenv

# Try importing the new Google Gen AI SDK
try:
    from google import genai
    from google.genai import types
    NEW_SDK_AVAILABLE = True
except ImportError:
    NEW_SDK_AVAILABLE = False

# Import file parsers
try:
    from pypdf import PdfReader
    import docx
    PARSERS_AVAILABLE = True
except ImportError:
    PARSERS_AVAILABLE = False

# Load environment variables
load_dotenv()

# Configure GenAI Client
api_key = os.getenv("GEMINI_API_KEY")
client = None
if api_key and NEW_SDK_AVAILABLE:
    try:
        client = genai.Client(api_key=api_key)
        print("Using new google-genai SDK Client.")
    except Exception as e:
        print(f"Error configuring google-genai Client: {e}")

class RAGEngine:
    def __init__(self, data_dir="backend/data", cache_file="backend/embeddings_cache.pkl"):
        self.data_dir = data_dir
        self.cache_file = cache_file
        self.documents = []  # List of dicts: {"text": str, "source": str, "metadata": dict}
        self.embeddings = None  # NumPy array of shape (num_docs, embedding_dim)
        
        # Load and chunk raw documents
        self.load_data()
        
        # Build or load vector embeddings
        self.build_index()

    def load_data(self):
        """Loads all JSON files in the data directory and structures them as chunks/documents."""
        if not os.path.exists(self.data_dir):
            print(f"Data directory {self.data_dir} not found. Creating it...")
            os.makedirs(self.data_dir, exist_ok=True)
            return

        self.documents = [] # reset
        for filename in os.listdir(self.data_dir):
            if not filename.endswith(".json"):
                continue
                
            filepath = os.path.join(self.data_dir, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                if isinstance(data, list):
                    # This is general_notes.json or uploaded structured list
                    for note in data:
                        text = (
                            f"Topic: {note.get('topic')}\n"
                            f"Subtopic: {note.get('subtopic')}\n"
                            f"Content: {note.get('content')}\n"
                            f"Tags: {', '.join(note.get('tags', []))}"
                        )
                        self.documents.append({
                            "text": text,
                            "source": note.get("source", f"General Notes - {note.get('topic')}"),
                            "metadata": {
                                "type": note.get("type", "note"), 
                                "topic": note.get("topic"),
                                "company": note.get("company", "General")
                            }
                        })
                elif isinstance(data, dict):
                    # Check if this is an uploaded unstructured document
                    if data.get("is_uploaded_document"):
                        company = data.get("company", "General")
                        source = data.get("source", filename)
                        doc_type = data.get("doc_type", "document")
                        for chunk in data.get("chunks", []):
                            self.documents.append({
                                "text": f"Company: {company}\nContext: {chunk}",
                                "source": source,
                                "metadata": {"type": doc_type, "company": company}
                            })
                    else:
                        # This is a standard company profile (tcs.json, etc.)
                        company = data.get("company_name", filename.split(".")[0].upper())
                        
                        # 1. Add Recruitment Process
                        process_text = "\n".join(data.get("recruitment_process", []))
                        self.documents.append({
                            "text": f"Company: {company}\nRecruitment Process:\n{process_text}",
                            "source": f"{company} Recruitment Pattern",
                            "metadata": {"type": "pattern", "company": company}
                        })
                        
                        # 2. Add Aptitude Topics
                        apt_text = "\n".join(data.get("aptitude_topics", []))
                        self.documents.append({
                            "text": f"Company: {company}\nImportant Aptitude Topics:\n{apt_text}",
                            "source": f"{company} Aptitude Syllabus",
                            "metadata": {"type": "aptitude", "company": company}
                        })
                        
                        # 3. Add Coding Questions
                        for q in data.get("coding_questions", []):
                            text = (
                                f"Company: {company}\n"
                                f"Coding Question: {q.get('title')}\n"
                                f"Description: {q.get('description')}\n"
                                f"Example Input: {q.get('input_example')}\n"
                                f"Example Output: {q.get('output_example')}\n"
                                f"Solution Code (Python):\n{q.get('solution_python')}"
                            )
                            self.documents.append({
                                "text": text,
                                "source": f"{company} Placement Paper / {q.get('source', 'Coding Bank')}",
                                "metadata": {"type": "coding", "company": company, "title": q.get("title")}
                            })
                            
                        # 4. Add Interview Experiences
                        for exp in data.get("interview_experiences", []):
                            questions_str = "\n".join([f"- {qi}" for qi in exp.get("questions", [])])
                            text = (
                                f"Company: {company}\n"
                                f"Interview Experience of {exp.get('author')} ({exp.get('role')})\n"
                                f"Round: {exp.get('round')}\n"
                                f"Experience Description: {exp.get('experience')}\n"
                                f"Questions Asked:\n{questions_str}"
                            )
                            self.documents.append({
                                "text": text,
                                "source": f"Senior Experience - {exp.get('author')}",
                                "metadata": {"type": "experience", "company": company, "author": exp.get("author")}
                            })
                            
                        # 5. Add HR Questions
                        for hr in data.get("hr_questions", []):
                            text = (
                                f"Company: {company}\n"
                                f"HR Question: {hr.get('question')}\n"
                                f"Suggested Answer Guide:\n{hr.get('suggested_answer')}"
                            )
                            self.documents.append({
                                "text": text,
                                "source": f"{company} HR Question Bank",
                                "metadata": {"type": "hr", "company": company, "question": hr.get("question")}
                            })
            except Exception as e:
                print(f"Error loading {filename}: {e}")

        print(f"Loaded {len(self.documents)} text chunks for RAG database.")

    def build_index(self):
        """Generates or loads embeddings for all document chunks."""
        # Try loading from cache if files and cache match size
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "rb") as f:
                    cache_data = pickle.load(f)
                if len(cache_data.get("documents", [])) == len(self.documents):
                    self.embeddings = cache_data.get("embeddings")
                    print("Loaded embeddings from cache.")
                    return
            except Exception as e:
                print(f"Failed to load embedding cache: {e}")

        # Fallback if no API client
        if not client:
            print("WARNING: GEMINI_API_KEY or google-genai SDK not available. PlacePrep will run in Keyword Fallback Mode.")
            return

        # Generate new embeddings
        print("Generating embeddings via google-genai API... (This might take a minute)")
        try:
            texts = [doc["text"] for doc in self.documents]
            batch_size = 50
            embeddings_list = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i+batch_size]
                response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=batch
                )
                # Map ContentEmbedding structures to values list
                embeddings_list.extend([emb.values for emb in response.embeddings])
            
            self.embeddings = np.array(embeddings_list)
            
            # Save to cache
            self.save_cache()
            print("Successfully cached embeddings.")
        except Exception as e:
            print(f"Error generating embeddings via google-genai API: {e}")
            self.embeddings = None

    def save_cache(self):
        """Saves current documents and embeddings matrix to cache file."""
        with open(self.cache_file, "wb") as f:
            pickle.dump({
                "documents": self.documents,
                "embeddings": self.embeddings
            }, f)

    def add_document(self, text, source, metadata):
        """Dynamically appends a new text chunk to the document index."""
        # Format text and append
        self.documents.append({
            "text": text,
            "source": source,
            "metadata": metadata
        })

        if client and self.embeddings is not None:
            try:
                # Embed single new chunk
                response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=text
                )
                new_vector = np.array(response.embeddings[0].values)
                # Append vector to numpy embeddings matrix
                self.embeddings = np.vstack([self.embeddings, new_vector])
                self.save_cache()
                print(f"Dynamically embedded and added chunk from: {source}")
            except Exception as e:
                print(f"Failed to dynamically embed chunk: {e}")
        else:
            print(f"Dynamically added chunk (keyword mode) from: {source}")

    def parse_and_add_file(self, file_content: bytes, filename: str, company: str, doc_type: str):
        """Parses PDF/DOCX/TXT file content, chunks it, adds it to index, and saves parsed representation."""
        if not PARSERS_AVAILABLE:
            raise Exception("File parsers (pypdf, python-docx) not installed.")

        # 1. Parse content to text
        ext = os.path.splitext(filename)[1].lower()
        parsed_text = ""

        if ext == ".txt":
            parsed_text = file_content.decode("utf-8", errors="ignore")
        elif ext == ".pdf":
            reader = PdfReader(io.BytesIO(file_content))
            pages_text = []
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    pages_text.append(txt)
            parsed_text = "\n".join(pages_text)
        elif ext == ".docx":
            doc = docx.Document(io.BytesIO(file_content))
            parsed_text = "\n".join([p.text for p in doc.paragraphs])
        else:
            raise Exception(f"Unsupported file format: {ext}")

        if not parsed_text.strip():
            raise Exception("Document appears to be empty or contains unreadable text.")

        # 2. Chunk text (e.g. 1000 characters, 150 characters overlap)
        chunk_size = 1000
        overlap = 150
        chunks = []
        
        start = 0
        while start < len(parsed_text):
            end = start + chunk_size
            chunks.append(parsed_text[start:end].strip())
            start += chunk_size - overlap

        # 3. Add chunks to RAG engine
        source_label = f"Uploaded File - {filename}"
        metadata = {
            "type": doc_type,
            "company": company
        }
        
        for idx, chunk in enumerate(chunks):
            chunk_formatted = f"Company: {company}\nFile Context [Part {idx+1}]:\n{chunk}"
            self.add_document(chunk_formatted, source_label, metadata)

        # 4. Save parsed chunks to backend/data/ for permanence across restarts
        sanitized_filename = "".join([c if c.isalnum() else "_" for c in filename])
        save_path = os.path.join(self.data_dir, f"uploaded_{sanitized_filename}.json")
        
        save_data = {
            "is_uploaded_document": True,
            "company": company,
            "source": source_label,
            "doc_type": doc_type,
            "chunks": chunks
        }
        
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(save_data, f, indent=2)

        return len(chunks)

    def retrieve(self, query, top_k=3, company_filter=None):
        """Retrieves top_k relevant documents for the query, matching company filter if provided."""
        if not self.documents:
            return []

        # Filter documents first if company_filter is specified
        filtered_indices = []
        for idx, doc in enumerate(self.documents):
            meta = doc["metadata"]
            if company_filter:
                comp_val = meta.get("company", "").lower()
                filter_val = company_filter.lower()
                # Include general notes, or match exact company
                if filter_val not in comp_val and meta.get("type") != "note" and comp_val != "general":
                    continue
            filtered_indices.append(idx)

        if not filtered_indices:
            filtered_indices = list(range(len(self.documents)))

        # RAG Search Mode using new SDK
        if self.embeddings is not None and client:
            try:
                # Embed query using new SDK
                query_response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=query
                )
                query_vector = np.array(query_response.embeddings[0].values)
                
                # Compute cosine similarities for filtered documents
                similarities = []
                for idx in filtered_indices:
                    doc_vector = self.embeddings[idx]
                    dot_product = np.dot(query_vector, doc_vector)
                    norm_q = np.linalg.norm(query_vector)
                    norm_d = np.linalg.norm(doc_vector)
                    cosine_similarity = dot_product / (norm_q * norm_d)
                    similarities.append((cosine_similarity, idx))
                
                # Sort desc
                similarities.sort(key=lambda x: x[0], reverse=True)
                
                # Take top_k
                results = []
                for score, idx in similarities[:top_k]:
                    doc = self.documents[idx].copy()
                    doc["score"] = float(score)
                    results.append(doc)
                return results
            except Exception as e:
                print(f"Error retrieving via google-genai vector search: {e}. Falling back to keyword search.")

        # Keyword Fallback Search Mode
        return self._keyword_search(query, filtered_indices, top_k)

    def _keyword_search(self, query, indices, top_k):
        """Simple word-overlap matching as a local fallback."""
        query_words = set(query.lower().split())
        scored_docs = []
        for idx in indices:
            doc = self.documents[idx]
            doc_words = doc["text"].lower()
            
            overlap = 0
            for word in query_words:
                if len(word) > 2:
                    overlap += doc_words.count(word)
            
            score = overlap / (len(doc_words.split()) ** 0.5 + 1)
            scored_docs.append((score, idx))
            
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, idx in scored_docs[:top_k]:
            if score > 0:
                doc = self.documents[idx].copy()
                doc["score"] = score
                results.append(doc)
        return results

# Self-test block
if __name__ == "__main__":
    engine = RAGEngine()
    res = engine.retrieve("TCS coding questions", top_k=2)
    print("\n--- TEST RETRIEVAL ---")
    for r in res:
        print(f"Source: {r['source']} (Score: {r.get('score', 0):.4f})")
