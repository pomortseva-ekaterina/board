#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <string>

#include "include/core/SkCanvas.h"
#include "include/core/SkPaint.h"
#include "include/core/SkRect.h"
#include "include/core/SkPath.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkColor.h"
#include "include/core/SkStream.h"
#include "include/core/SkMatrix.h"
#include "include/core/SkData.h"
#include "include/core/SkImage.h"
#include "include/encode/SkJpegEncoder.h"
#include "include/codec/SkJpegDecoder.h"
#include "include/docs/SkPDFDocument.h"

using namespace emscripten;

class SkMemoryWStream : public SkWStream {
public:
    bool write(const void* buffer, size_t size) override {
        const uint8_t* bytes = static_cast<const uint8_t*>(buffer);
        data_.insert(data_.end(), bytes, bytes + size);
        return true;
    }
    size_t bytesWritten() const override { return data_.size(); }
    const std::vector<uint8_t>& data() const { return data_; }
private:
    std::vector<uint8_t> data_;
};

void drawNode(SkCanvas* canvas, val node) {
    if (!node["visible"].as<bool>()) return;

    canvas->save();

    val m = node["localTransform"];
    SkMatrix matrix = SkMatrix::MakeAll(
        m["a"].as<float>(),  m["c"].as<float>(),  m["tx"].as<float>(),
        m["b"].as<float>(),  m["d"].as<float>(),  m["ty"].as<float>(),
        0, 0, 1
    );
    canvas->concat(matrix);

    std::string type = node["_type"].as<std::string>();

    if (type == "Graphics") {
        val graphicsData = node["graphicsData"];
        int len = graphicsData["length"].as<int>();

        for (int i = 0; i < len; i++) {
            val data = graphicsData[i];
            val shape = data["shape"];
            std::string shapeType = shape["_type"].as<std::string>();

            SkPath path;

            if (shapeType == "Rectangle") {
                float x = shape["x"].as<float>();
                float y = shape["y"].as<float>();
                float w = shape["width"].as<float>();
                float h = shape["height"].as<float>();
                path = SkPath::Rect(SkRect::MakeXYWH(x, y, w, h));
            } else if (shapeType == "Ellipse") {
                float x = shape["x"].as<float>();
                float y = shape["y"].as<float>();
                float hw = shape["halfWidth"].as<float>();
                float hh = shape["halfHeight"].as<float>();
                path = SkPath::Oval(SkRect::MakeXYWH(x - hw, y - hh, hw * 2, hh * 2));
            } else if (shapeType == "Circle") {
                float x = shape["x"].as<float>();
                float y = shape["y"].as<float>();
                float r = shape["radius"].as<float>();
                path = SkPath::Circle(x, y, r);
            } else if (shapeType == "Polygon") {
                val points = shape["points"];
                int plen = points["length"].as<int>();
                if (plen >= 2) {
                    SkPathBuilder builder;
                    builder.moveTo(points[0].as<float>(), points[1].as<float>());
                    for (int j = 2; j < plen; j += 2) {
                        builder.lineTo(points[j].as<float>(), points[j+1].as<float>());
                    }
                    builder.close();
                    path = builder.detach();
            Shape    }
            } else if (shapeType == "Polyline") {
                val points = shape["points"];
                int plen = points["length"].as<int>();
                if (plen >= 4) {
                    SkPathBuilder builder;
                    builder.moveTo(points[0].as<float>(), points[1].as<float>());
                    for (int j = 2; j < plen; j += 2) {
                        builder.lineTo(points[j].as<float>(), points[j+1].as<float>());
                    }
                    path = builder.detach();
                }
            }

            val fillStyle = data["fillStyle"];
            if (fillStyle["visible"].as<bool>()) {
                SkPaint paint;
                paint.setStyle(SkPaint::kFill_Style);
                paint.setAntiAlias(true);
                uint32_t hex = fillStyle["color"].as<uint32_t>();
                float alpha = fillStyle["alpha"].as<float>();
                paint.setColor(SkColorSetARGB(
                    (uint8_t)(alpha * 255),
                    (hex >> 16) & 0xff,
                    (hex >> 8) & 0xff,
                    hex & 0xff
                ));
                canvas->drawPath(path, paint);
            }

            val lineStyle = data["lineStyle"];
            if (lineStyle["visible"].as<bool>() && lineStyle["width"].as<float>() > 0) {
                SkPaint paint;
                paint.setStyle(SkPaint::kStroke_Style);
                paint.setAntiAlias(true);
                paint.setStrokeWidth(lineStyle["width"].as<float>());
                uint32_t hex = lineStyle["color"].as<uint32_t>();
                float alpha = lineStyle["alpha"].as<float>();
                paint.setColor(SkColorSetARGB(
                    (uint8_t)(alpha * 255),
                    (hex >> 16) & 0xff,
                    (hex >> 8) & 0xff,
                    hex & 0xff
                ));
                canvas->drawPath(path, paint);
            }
        }
    }

    val children = node["children"];
    if (!children.isNull() && !children.isUndefined()) {
        int childLen = children["length"].as<int>();
        for (int i = 0; i < childLen; i++) {
            drawNode(canvas, children[i]);
        }
    }

    canvas->restore();
}

val exportToPDF(val container, float pageWidth, float pageHeight) {
    SkMemoryWStream stream;

    SkPDF::Metadata metadata;
    metadata.fTitle = "Exported Scene";
    metadata.fCreator = "SkiaPDF";
    // Передаём JPEG кодеки — обязательно для Skia PDF
    metadata.jpegDecoder = [](sk_sp<const SkData> data) -> std::unique_ptr<SkCodec> {
        return SkJpegDecoder::Decode(data, nullptr, nullptr);
    };
    metadata.jpegEncoder = [](SkWStream* dst, const SkPixmap& src, int quality) -> bool {
        SkJpegEncoder::Options opts;
        opts.fQuality = quality;
        return SkJpegEncoder::Encode(dst, src, opts);
    };

    auto document = SkPDF::MakeDocument(&stream, metadata);
    if (!document) return val::null();

    SkCanvas* canvas = document->beginPage(pageWidth, pageHeight);
    drawNode(canvas, container);
    document->endPage();
    document->close();

    const auto& bytes = stream.data();
    val result = val::global("Uint8Array").new_(bytes.size());
    for (size_t i = 0; i < bytes.size(); i++) {
        result.set(i, bytes[i]);
    }
    return result;
}

EMSCRIPTEN_BINDINGS(skia_pdf) {
    function("exportToPDF", &exportToPDF);
}
